declare namespace Netlify {
  export class Headers {
    get(nfHeader: String): String;
  }

  export class Request {
    get url(): string;
    get headers(): Headers;
  }

  export class Event {
    getRequest(): Promise<Request>;
    getResponse(): Promise<Request>;
  }

  export interface EdgeFunction {
    onRequest?: (ev: Event) => void;
  }
}

declare var netlifyRegistry: {
  set: (name: string, fn: Netlify.EdgeFunction) => void;
};
