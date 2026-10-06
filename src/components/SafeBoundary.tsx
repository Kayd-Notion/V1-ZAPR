"use client";
import { Component, type ReactNode } from "react";

/**
 * Keeps an optional add-on from taking the whole site down: if it crashes
 * (e.g. a mistyped Privy App ID), it just renders nothing.
 */
export class SafeBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`${this.props.name} is off:`, error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
