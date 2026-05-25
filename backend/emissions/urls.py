from django.urls import path
from .views import NormalizedRecordListView, NormalizedRecordDetailView, DashboardStatsView

urlpatterns = [
    path("records/", NormalizedRecordListView.as_view(), name="records"),
    path("records/<uuid:pk>/", NormalizedRecordDetailView.as_view(), name="record-detail"),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
]
