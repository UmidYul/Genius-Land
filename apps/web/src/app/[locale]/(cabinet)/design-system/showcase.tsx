'use client';

import { formatSum } from '@gl/core/money';
import { formatDate } from '@gl/core/time';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
  useToast,
} from '@gl/ui';
import { Inbox, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

// Sample rows — not real data.
const sampleRows = [
  { n: 1, date: { year: 2026, month: 9, day: 1 }, amount: 1_000_000n },
  { n: 2, date: { year: 2026, month: 10, day: 1 }, amount: 250_000n },
  { n: 3, date: { year: 2026, month: 11, day: 1 }, amount: 0n },
];

export function DesignSystemShowcase() {
  const t = useTranslations('designSystem');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      <Card>
        <CardHeader>
          <CardTitle>{t('buttons')}</CardTitle>
        </CardHeader>
        <CardContent className="flex-row flex-wrap">
          <Button icon={<Plus strokeWidth={2} aria-hidden />}>{t('primary')}</Button>
          <Button variant="secondary">{t('secondary')}</Button>
          <Button variant="ghost">{t('ghost')}</Button>
          <Button variant="danger">{t('danger')}</Button>
          <Button disabled>{t('disabled')}</Button>
          <Button loading>{t('loadingButton')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('fields')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            id="ds-name"
            label={t('nameLabel')}
            placeholder={t('namePlaceholder')}
            hint={t('nameHint')}
          />
          <Input
            id="ds-amount"
            label={t('amountLabel')}
            inputMode="numeric"
            numeric
            defaultValue="-1"
            error={t('amountError')}
            required
          />
          <Select
            id="ds-branch"
            label={t('selectLabel')}
            placeholder={t('selectPlaceholder')}
            defaultValue=""
            options={[
              { value: 'a', label: t('selectOptionA') },
              { value: 'b', label: t('selectOptionB') },
            ]}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t('table')}</CardTitle>
        </CardHeader>
        <TableContainer className="ring-border-soft shadow-none ring-1">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('colName')}</TableHeaderCell>
                <TableHeaderCell>{t('colDate')}</TableHeaderCell>
                <TableHeaderCell numeric>{t('colAmount')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sampleRows.map((row) => (
                <TableRow key={row.n}>
                  <TableCell className="whitespace-nowrap">
                    {t('rowSample', { n: row.n })}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDate(row.date)}</TableCell>
                  <TableCell numeric>{formatSum(row.amount, locale)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('feedback')}</CardTitle>
        </CardHeader>
        <CardContent className="flex-row flex-wrap">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            {t('openDialog')}
          </Button>
          <Button variant="secondary" onClick={() => toast({ title: t('toastText') })}>
            {t('showToast')}
          </Button>
        </CardContent>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={t('dialogTitle')}
          description={t('dialogText')}
          closeLabel={tCommon('close')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={() => setDialogOpen(false)}>{tCommon('confirm')}</Button>
            </>
          }
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('skeleton')}</CardTitle>
        </CardHeader>
        <CardContent className="gap-3" aria-busy>
          <span className="sr-only">{tCommon('loading')}</span>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-1/2" />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 lg:col-span-2">
        <h2 className="font-head text-lg font-semibold">{t('empty')}</h2>
        <EmptyState
          icon={<Inbox strokeWidth={1.75} />}
          title={t('emptyTitle')}
          description={t('emptyText')}
        />
      </div>
    </div>
  );
}
