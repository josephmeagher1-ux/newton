import { HashRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { HomeShelf } from './components/HomeShelf';
import { SessionPage } from './components/SessionPage';
import { DevConsole } from './components/DevConsole';
import { ScenarioPage } from './components/ScenarioPage';
import { Settings } from './components/Settings';
import { requestPersistence } from './storage/persist';

export default function App() {
  useEffect(() => {
    requestPersistence();
  }, []);

  return (
    <HashRouter>
      <div className="h-full flex flex-col">
        <Routes>
          <Route path="/" element={<HomeShelf />} />
          <Route path="/pdf/:pdfId" element={<SessionPage />} />
          <Route path="/pdf/:pdfId/section/:sectionId" element={<SessionPage />} />
          <Route path="/dev" element={<DevConsole />} />
          <Route path="/scenario" element={<ScenarioPage />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
