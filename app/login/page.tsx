import { LoginPage } from "@/components/login-page";

interface LoginRouteProps {
  searchParams: Promise<{
    next?: string;
  }>;
}

export default async function LoginRoute({ searchParams }: LoginRouteProps) {
  const resolvedSearchParams = await searchParams;

  return <LoginPage nextPath={resolvedSearchParams.next} />;
}
