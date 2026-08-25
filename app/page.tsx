import { WorkspacePage } from "./WorkspacePage";

export default async function Home() {
  return <WorkspacePage initialView="dashboard" role="Usuario" returnTo="/" />;
}
