import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import candidatesReducer from './features/candidatesSlice.js';

const rootReducer = combineReducers({ candidates: candidatesReducer });
const persistConfig = { key: 'root', storage };
const persisted = persistReducer(persistConfig, rootReducer);

export const store = configureStore({ reducer: persisted, middleware: g => g({ serializableCheck: false }) });
export const persistor = persistStore(store);
