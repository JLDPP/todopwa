import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/dashboard.tsx";
import "./installPrompt.ts";
import PwaUpdater from "./components/PwaUpdater";
import Toaster from "./components/Toaster";
import Register from "./pages/register.tsx";
import React from "react";
import ReactDOM from "react-dom/client";
import './index.css';
import ProtectedRoute from "./routes/protected.route.tsx";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register/>} />

        <Route 
        path="/dashboard" 
        element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>} 
        />


        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PwaUpdater/>
      <Toaster/>
    </BrowserRouter>
  </React.StrictMode>
);