from django.urls import path
from .views import (
    DataSourceListView,
    UploadBatchListView,
    UploadBatchDetailView,
    SAPUploadView,
    UtilityUploadView,
    TravelUploadView,
)

urlpatterns = [
    path("data-sources/", DataSourceListView.as_view(), name="data-sources"),
    path("batches/", UploadBatchListView.as_view(), name="batches"),
    path("batches/<uuid:pk>/", UploadBatchDetailView.as_view(), name="batch-detail"),
    path("upload/sap/", SAPUploadView.as_view(), name="upload-sap"),
    path("upload/utility/", UtilityUploadView.as_view(), name="upload-utility"),
    path("upload/travel/", TravelUploadView.as_view(), name="upload-travel"),
]
