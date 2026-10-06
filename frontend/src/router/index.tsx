import { createBrowserRouter, Navigate } from "react-router-dom";
import Home from "../pages/Home/index";
import Personal from "../pages/Personal/index";
import Login from "../pages/Admin/Login";
import Editor from "../pages/Admin/Editor";
import { adminLoader, resumeLoader } from "../pages/Admin/loaders";
import RouteError from "../pages/RouteError";
import Loading from "../i18n/Loading";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/resume" replace /> },
  {
    path: "/resume",
    element: <Personal />,
    loader: resumeLoader,
    errorElement: <RouteError />,
    hydrateFallbackElement: <Loading />,
  },
  {
    path: "/admin/login",
    element: <Login />,
    errorElement: <RouteError /> },
  {
    path: "/admin/resume",
    element: <Editor />,
    loader: adminLoader,
    errorElement: <RouteError />,
    hydrateFallbackElement: <Loading admin />,
  },
  {
    path: "/personal",
    element: <Home />,
  },
  { path: "*", element: <RouteError /> },
]);

export default router;
