from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Team
from .permissions import IsTeamOwner, IsTeamOwnerOrReadOnly
from .serializers import TeamMemberSerializer, TeamSerializer


User = get_user_model()


class TeamListCreateView(generics.ListCreateAPIView):
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Team.objects.filter(
            Q(members=self.request.user) | Q(created_by=self.request.user)
        ).distinct()

    def perform_create(self, serializer):
        team = serializer.save(created_by=self.request.user)
        team.members.add(self.request.user)


class TeamDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated, IsTeamOwnerOrReadOnly]

    def get_queryset(self):
        return Team.objects.filter(
            Q(members=self.request.user) | Q(created_by=self.request.user)
        ).distinct()


class TeamMemberView(generics.GenericAPIView):
    serializer_class = TeamMemberSerializer
    permission_classes = [IsAuthenticated, IsTeamOwner]

    def get_queryset(self):
        return Team.objects.all()

    def post(self, request, pk):
        team = self.get_object()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_id = serializer.validated_data.get("user_id")
        username = serializer.validated_data.get("username")
        email = serializer.validated_data.get("email")

        user = None
        if user_id:
            user = User.objects.filter(id=user_id).first()
        elif username:
            user = User.objects.filter(username__iexact=username).first()
        elif email:
            user = User.objects.filter(email__iexact=email).first()

        if not user:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if team.members.filter(id=user.id).exists():
            return Response(
                {"detail": "User is already a member of this team."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        team.members.add(user)

        return Response(
            {"detail": "User added to team successfully."},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk, user_id=None):
        team = self.get_object()

        user_id = user_id or request.data.get("user_id") or request.query_params.get("user_id")

        if not user_id:
            return Response(
                {"detail": "user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user == team.created_by:
            return Response(
                {"detail": "The team owner cannot be removed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        team.members.remove(user)

        return Response(
            {"detail": "User removed from team successfully."},
            status=status.HTTP_200_OK,
        )