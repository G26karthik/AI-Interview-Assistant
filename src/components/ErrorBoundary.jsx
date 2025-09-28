import React from 'react';
export default class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state={error:null}; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(err, info){ console.error('ErrorBoundary', err, info); }
  render(){ if(this.state.error) return <div role="alert">Something went wrong. Please refresh.</div>; return this.props.children; }
}
