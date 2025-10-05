// src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AllPapers from "./pages/AllPapers";
import SavedPapers from "./pages/SavedPapers";
import Home from "./pages/Home"; // your landing page

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/all" element={<AllPapers />} />
      <Route path="/saved" element={<SavedPapers />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
