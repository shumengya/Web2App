import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import BuildList from "./pages/BuildList";
import JobStatus from "./pages/JobStatus";
import Upload from "./pages/Upload";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Upload />} />
        <Route path="/jobs" element={<BuildList />} />
        <Route path="/jobs/:id" element={<JobStatus />} />
      </Route>
    </Routes>
  );
}
