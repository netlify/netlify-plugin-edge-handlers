declare namespace Netlify {
  export class Headers {}

  export class Request {
    get url(): string;
    get headers(): Headers;
  }

  export class Event {
    getRequest(): Promise<Request>;
  }

  export interface EdgeFunction {
    onRequest?: (ev: Event) => void;
    onResponse?: (ev: Event) => void;
  }
}

declare var netlifyRegistry: {
  set: (name: string, fn: Netlify.EdgeFunction) => void;
};
