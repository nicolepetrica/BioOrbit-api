import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import AllPapers from "./pages/AllPapers";
import SavedPapers from "./pages/SavedPapers";
import AskAI from "./pages/AskAI";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/all" element={<AllPapers />} />
      <Route path="/saved" element={<SavedPapers />} />
      <Route path="/ask" element={<AskAI />} />
    </Routes>
  );
}
