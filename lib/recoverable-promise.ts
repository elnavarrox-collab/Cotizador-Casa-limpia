export function resetPromiseOnRejection<T>(promise: Promise<T>, reset: (rejected: Promise<T>) => void) {
  void promise.catch(() => reset(promise));
  return promise;
}
