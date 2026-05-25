from django.urls import path
from .views import AuditLogListView, RecordAuditView

urlpatterns = [
    path("audit/", AuditLogListView.as_view(), name="audit-list"),
    path("records/<uuid:pk>/audit/", RecordAuditView.as_view(), name="record-audit"),
]
