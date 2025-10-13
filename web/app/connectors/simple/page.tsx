'use client';

import { useState } from 'react';

export default function SimpleConnectorPage() {
  const [step, setStep] = useState(1);
  const [connectorName, setConnectorName] = useState('');

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Create New Connector</h1>
      <p>Step {step} of 3</p>
      
      {step === 1 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Step 1: Basic Info</h2>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Connector Name:</label>
            <input 
              type="text"
              value={connectorName}
              onChange={(e) => setConnectorName(e.target.value)}
              style={{ padding: '8px', width: '300px', border: '1px solid #ccc' }}
              placeholder="Enter connector name"
            />
          </div>
          <button 
            onClick={() => setStep(2)}
            disabled={!connectorName}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: connectorName ? '#007bff' : '#ccc',
              color: 'white',
              border: 'none',
              cursor: connectorName ? 'pointer' : 'not-allowed'
            }}
          >
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Step 2: Configuration</h2>
          <p>Connector: {connectorName}</p>
          <div style={{ marginTop: '10px' }}>
            <button onClick={() => setStep(1)} style={{ padding: '10px 20px', marginRight: '10px' }}>
              Back
            </button>
            <button onClick={() => setStep(3)} style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none' }}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Step 3: Review</h2>
          <p>Ready to create connector: {connectorName}</p>
          <div style={{ marginTop: '10px' }}>
            <button onClick={() => setStep(2)} style={{ padding: '10px 20px', marginRight: '10px' }}>
              Back
            </button>
            <button 
              onClick={() => alert('Connector would be created!')}
              style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none' }}
            >
              Create Connector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}