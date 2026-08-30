from django.urls import path

from .views import CurrentUserView, RegisterView, UserListView


urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("users/", UserListView.as_view(), name="user-list"),
]