// src/App.js
import React from "react";
import "./App.css";
import SubscriptionForm from "./components/SubscriptionForm";

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Blog Subscription</h1>
      </header>
      <main>
        <SubscriptionForm />
      </main>
      <footer>
        <p>&copy; {new Date().getFullYear()} My Blog. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
