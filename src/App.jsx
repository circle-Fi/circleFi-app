import React, { useEffect } from 'react';
import { CircleProvider } from './context/CircleContext';
import { CircleForm } from './components/CircleForm';
import { CircleList } from './components/CircleList';
import './App.css';

function App() {
  return (
    <CircleProvider>
      <div className="App">
        <header className="App-header">
          <h1>CircleFi</h1>
          <p>On-Chain Rotating Savings Circles</p>
        </header>
        <main className="App-main">
          <div className="container">
            <section className="form-section">
              <CircleForm />
            </section>
            <section className="list-section">
              <CircleList circles={[]} onSelectCircle={() => {}} />
            </section>
          </div>
        </main>
      </div>
    </CircleProvider>
  );
}

export default App;
