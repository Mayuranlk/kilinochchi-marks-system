import React from "react";
import ErrorState from "./ErrorState";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Page rendering error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorState onAction={() => window.location.reload()} />;
    }

    return this.props.children;
  }
}
