"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function TransactionSkeleton() {
  return (
    <div className="flex items-center justify-between p-5">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-4 w-20 ml-auto" />
        <Skeleton className="h-2 w-2 rounded-full ml-auto" />
      </div>
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="p-5 flex gap-4">
      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2 w-16" />
      </div>
    </div>
  );
}

export function DashboardStatSkeleton() {
  return (
    <Card className="border-none shadow-premium bg-card">
      <CardContent className="p-7">
        <div className="flex justify-between items-center">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <Skeleton className="h-6 w-16 rounded-xl" />
        </div>
        <div className="space-y-2 pt-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      </CardContent>
    </Card>
  );
}
