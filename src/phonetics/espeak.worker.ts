/// <reference lib="webworker" />
/**
 * Web worker running eSpeak-NG (see `espeak.ts`) off the main thread, in the normal build: a long
 * speech takes a few hundred milliseconds to phonemize.
 *
 * @packageDocumentation
 */
import { handleRequest, type PhonemizeRequest } from './espeak'

self.onmessage = async (e: MessageEvent<PhonemizeRequest>) => {
  self.postMessage(await handleRequest(e.data))
}
