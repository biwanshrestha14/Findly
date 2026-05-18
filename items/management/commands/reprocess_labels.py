"""
Management command to re-process labels for existing items.

Runs MobileNetV2 label extraction on all items that have an image
but empty label_scores.  Use --all to re-process even items that
already have labels.

Usage:
    python manage.py reprocess_labels
    python manage.py reprocess_labels --all
    python manage.py reprocess_labels --batch-size 10
"""

import io
from django.core.management.base import BaseCommand
from PIL import Image
from rembg import remove

from items.models import Item
from services.label_extraction import extract_labels, labels_to_list


class Command(BaseCommand):
    help = 'Re-run MobileNetV2 label extraction on existing items.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--all',
            action='store_true',
            dest='reprocess_all',
            help='Re-process all items, even those with existing labels.',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=50,
            help='Number of items to process per batch (default: 50).',
        )

    def handle(self, *args, **options):
        reprocess_all = options['reprocess_all']
        batch_size = options['batch_size']

        queryset = Item.objects.exclude(image='').exclude(image__isnull=True)

        if not reprocess_all:
            # Only process items with empty label_scores
            queryset = queryset.filter(label_scores=[])

        total = queryset.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS('No items to process.'))
            return

        self.stdout.write(f'Found {total} item(s) to process.')
        success = 0
        failed = 0

        for i, item in enumerate(queryset.iterator(chunk_size=batch_size), 1):
            self.stdout.write(f'[{i}/{total}] Processing item {item.id}: "{item.title}"...', ending='')
            try:
                # Read image
                item.image.open()
                img_data = item.image.read()
                item.image.close()

                # Background removal
                processed_data = remove(img_data)
                cleaned_image = Image.open(io.BytesIO(processed_data)).convert('RGB')

                # Label extraction
                label_results = extract_labels(cleaned_image, top_n=10, min_confidence=0.03)
                item.labels = labels_to_list(label_results)
                item.label_scores = label_results
                item.save(update_fields=['labels', 'label_scores'])

                labels_str = ', '.join(r['label'] for r in label_results[:5])
                self.stdout.write(self.style.SUCCESS(
                    f' OK — {len(label_results)} labels: {labels_str}'
                ))
                success += 1

            except Exception as e:
                self.stdout.write(self.style.ERROR(f' FAILED — {e}'))
                failed += 1

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Done. {success} succeeded, {failed} failed out of {total} total.'
        ))
