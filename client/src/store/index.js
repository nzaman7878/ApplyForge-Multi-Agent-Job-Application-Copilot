import { configureStore } from '@reduxjs/toolkit';
import applyReducer from './applySlice';

export const store = configureStore({
  reducer: {
    apply: applyReducer,
  },
});

export default store;
