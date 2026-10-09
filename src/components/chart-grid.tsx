"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChartPane } from "@/components/chart-pane";
import { PANES } from "@/lib/sample-data";

function Pane({ index }: { index: number }) {
  return (
    <ResizablePanel defaultSize="50" minSize="15" className="min-h-0 min-w-0">
      <ChartPane spec={PANES[index]} />
    </ResizablePanel>
  );
}

export function ChartGrid() {
  return (
    <ResizablePanelGroup orientation="vertical" className="h-dvh w-full">
      <ResizablePanel defaultSize="50" minSize="15" className="min-h-0">
        <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
          <Pane index={0} />
          <ResizableHandle withHandle />
          <Pane index={1} />
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="50" minSize="15" className="min-h-0">
        <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
          <Pane index={2} />
          <ResizableHandle withHandle />
          <Pane index={3} />
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
