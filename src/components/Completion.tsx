import { entryDeadlineNotice } from '../config/entry-window';
import { useEffect, useRef } from 'react';
import type { CompletionData } from './LocalEntry';

export default function Completion({ value }: { value: CompletionData }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const download = () => {
    const contents = [
      'そらふぇす大会エントリー保存票',
      '大会：frog-assemble-2026',
      `再確認ID：${value.recoveryId}`,
      `受付番号：${value.receipt}`,
      `編集コード：${value.editCode}`,
      '',
      entryDeadlineNotice,
    ].join('\n');
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sorafes-entry-receipt.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <section className="completion" aria-labelledby="completion-heading">
    <p className="eyebrow">ENTRY COMPLETE</p>
    <h2 id="completion-heading" tabIndex={-1} ref={heading}>{value.updated ? '応募内容を更新しました' : '応募を受け付けました'}</h2>
    <p>保存が正常に完了しました。次の情報は応募内容の確認・修正に必要です。</p>
    <dl className="credential-list">
      <div><dt>受付番号</dt><dd><strong>{value.receipt}</strong></dd></div>
      <div><dt>編集コード</dt><dd>{value.editCode}</dd></div>
      <div><dt>再確認ID</dt><dd>{value.recoveryId}</dd></div>
    </dl>
    <button type="button" className="primary" onClick={download}>保存票をダウンロード</button>
    <p className="hint">{entryDeadlineNotice}</p>
    <p className="notice">受付完了は当選・参加確定を意味しません。応募多数の場合は抽選となります。</p>
    <p className="hint">保存票を安全な場所に保管してください。編集コードを紛失した場合は運営Xアカウントへご相談ください。</p>
  </section>;
}
