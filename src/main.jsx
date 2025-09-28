import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import 'antd/dist/reset.css';
import './global.css';
import App from './App.jsx';
import { ConfigProvider, theme } from 'antd';
import { store, persistor } from './store.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <ConfigProvider
        theme={{
          token: {
            borderRadius: 10,
            colorPrimary: '#6366f1',
            colorInfo: '#6366f1',
            fontFamily: 'Inter, system-ui, sans-serif'
          },
          components: {
            Button: { controlHeight: 38 },
            Tag: { colorBgContainer: 'rgba(255,255,255,0.08)' }
          }
        }}
      >
        <App />
      </ConfigProvider>
    </PersistGate>
  </Provider>
);
