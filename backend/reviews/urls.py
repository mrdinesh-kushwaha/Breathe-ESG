from django.urls import path
from .views import ReviewDecisionListView, ReviewActionView, BulkReviewView

urlpatterns = [
    path("decisions/", ReviewDecisionListView.as_view(), name="decisions"),
    path("records/<uuid:pk>/review/", ReviewActionView.as_view(), name="review-action"),
    path("records/bulk-review/", BulkReviewView.as_view(), name="bulk-review"),
]
