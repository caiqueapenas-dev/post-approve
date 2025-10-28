import { useState, useEffect, createContext, useContext } from 'react';

type Route = {
  path: string;
  element: JSX.Element;
};

type RouterContextType = {
  navigate: (path: string) => void;
  params: Record<string, string>;
};

const RouterContext = createContext<RouterContextType | null>(null);

export const useNavigate = () => {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useNavigate must be used within Router');
  return context.navigate;
};

export const useParams = () => {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useParams must be used within Router');
  return context.params;
};

export const Router = ({ routes }: { routes: Route[] }) => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [params, setParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const matchRoute = () => {
    for (const route of routes) {
      const routeParts = route.path.split('/');
      const pathParts = currentPath.split('/');

      if (routeParts.length !== pathParts.length) continue;

      const matches = routeParts.every((part, i) => {
        if (part.startsWith(':')) return true;
        return part === pathParts[i];
      });

      if (matches) {
        const newParams: Record<string, string> = {};
        routeParts.forEach((part, i) => {
          if (part.startsWith(':')) {
            newParams[part.slice(1)] = pathParts[i];
          }
        });
        setParams(newParams);
        return route.element;
      }
    }

    return routes.find((r) => r.path === '*')?.element || <div>404 Not Found</div>;
  };

  return (
    <RouterContext.Provider value={{ navigate, params }}>
      {matchRoute()}
    </RouterContext.Provider>
  );
};
