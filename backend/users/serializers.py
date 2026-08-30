from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Allow login with either email or username."""

    username_field = User.USERNAME_FIELD

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Allow both email or username field
        self.fields["email"] = serializers.CharField(required=False, allow_blank=True)
        if "username" in self.fields:
            self.fields["username"].required = False

    def validate(self, attrs):
        identifier = (attrs.get("email") or attrs.get("username") or "").strip()
        password = attrs.get("password", "")

        if not identifier:
            raise serializers.ValidationError(
                {"detail": "Email or username is required."}
            )

        if not password:
            raise serializers.ValidationError(
                {"detail": "Password is required."}
            )

        user = User.objects.filter(
            Q(email__iexact=identifier) | Q(username__iexact=identifier)
        ).first()

        if not user:
            raise serializers.ValidationError(
                {"detail": "No account found with that email or username."}
            )

        if not user.check_password(password):
            raise serializers.ValidationError(
                {"detail": "Incorrect password."}
            )

        if not user.is_active:
            raise serializers.ValidationError(
                {"detail": "This account has been deactivated."}
            )

        attrs[self.username_field] = user.get_username()
        attrs.pop("email", None)

        data = super().validate(attrs)
        data["username"] = user.username
        data["email"] = user.email
        data["user_id"] = user.id
        return data