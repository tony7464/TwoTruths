// If the cube throws while loading, tell the app so it can switch to the flat pages.
import { Component } from "react";

export default class CubeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) {
      const message = this.state.error.message || "unknown error";
      return (
        <p role="alert" className="p-4 text-sm text-rose-800">
          {`3D view is off because the cube failed to load: ${message}`}
        </p>
      );
    }
    return this.props.children;
  }
}
