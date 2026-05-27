"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Clock, ExternalLink } from "lucide-react";
import { WorkflowExecution } from "@/lib/workflows/types";

interface WorkflowExecutionHistoryProps {
  executions: WorkflowExecution[];
}

export function WorkflowExecutionHistory({ executions }: WorkflowExecutionHistoryProps) {
  if (!executions || executions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No executions yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution History</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {executions.map((execution) => (
              <div
                key={execution.id}
                className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {execution.status === "success" && (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  )}
                  {execution.status === "failed" && (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  )}
                  {execution.status === "running" && (
                    <Clock className="h-5 w-5 text-blue-500 mt-0.5 animate-pulse" />
                  )}
                  {execution.status === "pending" && (
                    <Clock className="h-5 w-5 text-gray-500 mt-0.5" />
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          execution.status === "success"
                            ? "default"
                            : execution.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {execution.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(execution.created_at).toLocaleString()}
                      </span>
                    </div>

                    {execution.error && (
                      <p className="text-sm text-red-500">{execution.error}</p>
                    )}

                    {execution.tx_hash && (
                      <a
                        href={`https://explorer.circle.com/tx/${execution.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        View transaction
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                {execution.completed_at && (
                  <span className="text-xs text-muted-foreground">
                    {Math.round(
                      (new Date(execution.completed_at).getTime() -
                        new Date(execution.created_at).getTime()) /
                        1000
                    )}
                    s
                  </span>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
