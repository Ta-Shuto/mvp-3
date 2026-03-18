import { TableSkeleton } from "@/components/common/Skeleton";
import { Skeleton } from "@/components/common/Skeleton";

export default function CasesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <TableSkeleton rows={8} />
    </div>
  );
}
