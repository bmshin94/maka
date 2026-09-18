/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useState } from 'react';
import { QUOTE_COMMENT_MAX_LENGTH, type QuoteRef } from '@maka/core/events';
import {
  appendPending,
  clearPending,
  removePending,
  selectPending,
  updatePending,
  type PendingByKey,
} from './pending-items.js';

/**
 * Excerpts longer than this are truncated before staging. Kept equal to the
 * `sessions:send` normalizer's per-quote cap so the renderer can never stage
 * something the IPC boundary would reject on send.
 */
const MAX_QUOTE_CHARS = 32_000;

/**
 * Quoted excerpts staged for the next send, keyed by draft key so each session
 * keeps its own (mirrors pending attachments). Cleared once the turn is sent.
 */
export function useAppShellComposerQuotes(options: { draftKey: string }) {
  const [pendingByKey, setPendingByKey] = useState<PendingByKey<QuoteRef>>({});
  const pendingQuotes = selectPending(pendingByKey, options.draftKey);

  function addQuote(input: {
    text: string;
    turnId?: string;
    label?: string;
    comment?: string;
  }): void {
    const text = input.text.slice(0, MAX_QUOTE_CHARS).trim();
    if (!text) return;
    const comment = input.comment?.slice(0, QUOTE_COMMENT_MAX_LENGTH).trim();
    const ownerKey = options.draftKey;
    const quote: QuoteRef = {
      text,
      ...(input.label ? { label: input.label } : {}),
      ...(comment ? { comment } : {}),
      ...(input.turnId ? { sourceTurnId: input.turnId } : {}),
    };
    setPendingByKey((map) => appendPending(map, ownerKey, [quote]));
  }

  function updateQuoteComment(index: number, comment: string): void {
    const next = comment.slice(0, QUOTE_COMMENT_MAX_LENGTH).trim();
    const ownerKey = options.draftKey;
    setPendingByKey((map) =>
      updatePending(map, ownerKey, index, (quote) => {
        // An emptied note removes the field rather than keeping the old one:
        // the excerpt is still staged, it simply carries nothing now.
        const { comment: _previous, ...rest } = quote;
        return next ? { ...rest, comment: next } : rest;
      }),
    );
  }

  function removeQuote(index: number): void {
    const ownerKey = options.draftKey;
    setPendingByKey((map) => removePending(map, ownerKey, index));
  }

  function clearQuotes(): void {
    const ownerKey = options.draftKey;
    setPendingByKey((map) => clearPending(map, ownerKey));
  }

  function clearAllQuotes(): void {
    setPendingByKey({});
  }

  function restoreQuotes(ownerKey: string, quotes: readonly QuoteRef[]): void {
    if (quotes.length === 0) return;
    setPendingByKey((map) =>
      appendPending(
        map,
        ownerKey,
        quotes.map((quote) => ({ ...quote })),
      ),
    );
  }

  return {
    pendingQuotes,
    addQuote,
    updateQuoteComment,
    removeQuote,
    clearQuotes,
    clearAllQuotes,
    restoreQuotes,
  };
}
