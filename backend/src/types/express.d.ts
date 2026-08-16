declare global {
  namespace Express {
    interface Request {
      id?: string;
      rawBody?: Buffer;
      user?: import('./auth.js').AuthUser | null;
      validatedBody?: any;
      validatedQuery?: any;
      consultationActor?: import('./auth.js').ConsultationActor;
    }
  }
}

export {};
