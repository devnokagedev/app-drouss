import { useAuth } from "@/hooks/useAuth";
import Auth from "./Auth";
import Home from "./Home";

const Index = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-soft flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Chargement...</p>
      </div>
    );
  }

  return session ? <Home /> : <Auth />;
};

export default Index;
