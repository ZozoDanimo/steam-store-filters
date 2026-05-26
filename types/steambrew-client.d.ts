/**
 * Type stubs for @steambrew/client
 * The real runtime is provided by Steam's webpack environment and millennium-ttc.
 */

declare const Millennium: {
  callServerMethod: (methodName: string, kwargs?: object) => Promise<any>;
  findElement: (doc: Document, querySelector: string, timeOut?: number) => Promise<NodeListOf<Element>>;
  exposeObj: <T extends object>(obj: T) => void;
  AddWindowCreateHook: (callback: (context: any) => void) => void;
};

declare module '@steambrew/client' {
  import React from 'react';

  // ─── Core Millennium API ────────────────────────────────────────────────

  export const Millennium: {
    callServerMethod: (methodName: string, kwargs?: object) => Promise<any>;
    findElement: (
      doc: Document,
      querySelector: string,
      timeOut?: number
    ) => Promise<NodeListOf<Element>>;
    exposeObj: <T extends object>(obj: T) => void;
    AddWindowCreateHook: (callback: (context: any) => void) => void;
  };

  export function callable<
    Params extends [params: Record<string, any>] | [] = [],
    Return = any
  >(route: string): (...params: Params) => Promise<Return>;

  export function findModule(filter: (module: any) => boolean): any;
  export function findClassModule(filter: (module: any) => boolean): any;
  export function sleep(ms: number): Promise<void>;

  // ─── Plugin definition ──────────────────────────────────────────────────

  export interface PluginDef {
    title: string;
    icon?: React.ReactNode;
    content?: React.ReactNode;
    titleView?: React.ReactNode;
    alwaysRender?: boolean;
    onDismount?(): void;
  }

  export function definePlugin(fn: () => PluginDef | Promise<PluginDef>): any;

  // ─── Steam UI Components ────────────────────────────────────────────────

  export interface FieldProps {
    label?: string;
    description?: string | React.ReactNode;
    icon?: React.ReactNode;
    bottomSeparator?: 'standard' | 'thick' | 'none';
    focusable?: boolean;
    children?: React.ReactNode;
  }

  export const Field: React.FC<FieldProps>;

  export interface ToggleProps {
    value: boolean;
    onChange?: (value: boolean) => void;
    disabled?: boolean;
  }

  export const Toggle: React.FC<ToggleProps>;

  export interface DialogButtonProps {
    onClick?: () => void;
    disabled?: boolean;
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }

  export const DialogButton: React.FC<DialogButtonProps>;

  export interface TextFieldProps {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    disabled?: boolean;
  }

  export const TextField: React.FC<TextFieldProps>;

  // ─── Icons ──────────────────────────────────────────────────────────────

  export const IconsModule: {
    Settings: React.FC;
    MagnifyingGlass: React.FC;
    Search: React.FC;
    [key: string]: React.FC;
  };

  // ─── Menu ───────────────────────────────────────────────────────────────

  export const Menu: React.FC<{ label?: string; children?: React.ReactNode }>;
  export const MenuItem: React.FC<{
    onSelected?: () => void;
    children?: React.ReactNode;
  }>;
  export function showContextMenu(menu: React.ReactNode, element?: Element): void;

  export function pluginSelf(): any;

  // ─── Navigation ─────────────────────────────────────────────────────────

  export const Navigation: {
    Navigate(path: string): void;
    NavigateBack(): void;
    NavigateToExternalWeb(url: string): void;
    NavigateToSteamWeb(url: string): void;
    NavigateToChat(): void;
    NavigateToLibraryTab(): void;
    CloseSideMenus(): void;
  };

  // ─── Router Hook ──────────────────────────────────────────────────────

  export const routerHook: {
    addRoute(path: string, component: React.ComponentType, props?: Record<string, any>): void;
    removeRoute(path: string): void;
    addPatch(path: string, patch: (route: any) => any, uiMode?: number): any;
    removePatch(path: string, patch: any, uiMode?: number): void;
    addGlobalComponent(name: string, component: React.FC, uiMode?: number): void;
    removeGlobalComponent(name: string, uiMode?: number): void;
    registerForRouterSetup(callback: () => void): Promise<void>;
  };
}
