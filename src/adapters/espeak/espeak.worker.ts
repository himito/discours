/// <reference lib="webworker" />
/**
 * Web worker running eSpeak-NG (see `engine.ts`) off the main thread: a long speech takes a few
 * hundred milliseconds to phonemize.
 *
 * @packageDocumentation
 */
import { handleRequest, type PhonemizeRequest } from './engine'

self.onmessage = async (e: MessageEvent<PhonemizeRequest>) => {
  self.postMessage(await handleRequest(e.data))
}
