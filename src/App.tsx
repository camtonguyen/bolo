import { TerminalShell } from './terminal/TerminalShell';
import { MarkerAuthoringTool } from './dev/MarkerAuthoringTool';

export default function App() {
  // Dev-only marker authoring route (visit /#markers-tool). Stripped from
  // production builds: import.meta.env.DEV is statically false there, so
  // Vite dead-code-eliminates this branch and MarkerAuthoringTool's chunk.
  if (import.meta.env.DEV && location.hash === '#markers-tool') {
    return <MarkerAuthoringTool />;
  }
  return <TerminalShell />;
}
