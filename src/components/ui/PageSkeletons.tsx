import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function BalanceSkeleton() {
  return (
    <div className="w-full max-w-xl mx-auto text-center py-4 sm:py-6 px-4">
      <Skeleton className="h-3 w-24 mx-auto mb-4" />
      <Skeleton className="h-12 w-64 mx-auto mb-4" />
      <div className="flex items-center justify-center gap-2 mt-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-36 rounded-full" />
      </div>
    </div>
  );
}

export function QuickActionsSkeleton() {
  return (
    <div className="w-full max-w-xl mx-auto flex gap-3">
      <Skeleton className="flex-1 h-12 rounded-xl" />
      <Skeleton className="flex-1 h-12 rounded-xl" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="border-none shadow-premium bg-card overflow-hidden">
      <CardContent className="p-5">
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-7 w-24 mb-1" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

export function InvoiceRowSkeleton() {
  return (
    <div className="group p-5 rounded-2xl bg-muted/20 border border-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex-1 flex items-center gap-5">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/40">
        <div className="text-right space-y-1">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
    </div>
  );
}

export function SubscriptionRowSkeleton() {
  return (
    <div className="group p-5 rounded-2xl bg-muted/20 border border-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex-1 flex items-center gap-5">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-48" />
          <div className="flex gap-3 mt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/40">
        <div className="text-right space-y-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-14" />
        </div>
        <Skeleton className="h-9 w-20 rounded-xl" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
    </div>
  );
}

export function TipMessageSkeleton() {
  return (
    <div className="p-3 rounded-xl bg-muted/20 flex items-start justify-between gap-3">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-12 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export function AnalyticsMetricSkeleton() {
  return (
    <Card className="border-none shadow-premium bg-card overflow-hidden">
      <CardContent className="p-6 space-y-2">
        <div className="flex justify-between items-center">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="w-8 h-8 rounded-lg" />
        </div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton() {
  return (
    <Card className="border-none shadow-premium bg-card p-8 overflow-hidden">
      <CardHeader className="p-0 pb-6">
        <Skeleton className="h-5 w-48 mb-2" />
        <Skeleton className="h-3 w-72" />
      </CardHeader>
      <CardContent className="p-0 h-80 flex items-center justify-center">
        <Skeleton className="w-full h-64 rounded-xl" />
      </CardContent>
    </Card>
  );
}

export function TipsPageHeaderSkeleton() {
  return (
    <div className="space-y-10 pb-12 px-4 md:px-6 relative">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-10 w-32 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-11 w-44 rounded-xl" />
          <Skeleton className="h-11 w-28 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function SendPageSkeleton() {
  return (
    <div className="space-y-8 pb-12 px-4 md:px-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Card className="border-none shadow-premium bg-card overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <div className="space-y-6 mt-4">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20 ml-1" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16 ml-1" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
                <Skeleton className="h-12 w-40 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-5 space-y-8">
          <Card className="border-none shadow-premium bg-primary/20 overflow-hidden">
            <CardContent className="p-8">
              <Skeleton className="h-3 w-32 mb-4" />
              <Skeleton className="h-10 w-48 mb-4" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
