import { CardSkeleton, Skeleton } from "@/components/common/Skeleton";

export default function AnalysisLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-5">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-32 w-32 rounded-full mx-auto" />
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-32 w-32 rounded-full mx-auto" />
        </div>
      </div>
    </div>
  );
}
