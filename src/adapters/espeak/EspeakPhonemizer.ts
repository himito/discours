/**
 * {@link Phonemizer} backed by eSpeak-NG, running in a web worker.
 *
 * @packageDocumentation
 */
import type { PhonemeTrace, Phonemizer } from '@/core/phonetics/Phonemizer'
import type { PhonemizeRequest, PhonemizeResponse } from './engine'

/**
 * Phonemizes with eSpeak-NG's French voice, off the main thread.
 *
 * @remarks The worker, and the ~700 KB French data it loads, start on the first request (or on
 * {@link EspeakPhonemizer.warmUp}).
 */
export class EspeakPhonemizer implements Phonemizer {
  private worker: Worker | undefined
  private nextId = 1
  private readonly pending = new Map<number, (response: PhonemizeResponse) => void>()

  async phonemize(texts: readonly string[]): Promise<PhonemeTrace[]> {
    const response = await this.request({ id: this.nextId++, texts: [...texts] })
    if ('error' in response) throw new Error(response.error)
    return response.results
  }

  warmUp(): void {
    void this.phonemize([''])
  }

  /** Sends a request to the worker, starting it on first use. */
  private request(request: PhonemizeRequest): Promise<PhonemizeResponse> {
    return new Promise((resolve) => {
      this.pending.set(request.id, resolve)
      this.getWorker().postMessage(request)
    })
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./espeak.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (e: MessageEvent<PhonemizeResponse>) => {
        this.pending.get(e.data.id)?.(e.data)
        this.pending.delete(e.data.id)
      }
    }
    return this.worker
  }
}
