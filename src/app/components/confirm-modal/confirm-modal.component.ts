import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-confirm-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './confirm-modal.component.html',
    styleUrls: ['./confirm-modal.component.scss'],
})
export class ConfirmModalComponent {
    @Input() title = 'Confirmar ação';
    @Input() message = 'Tem certeza que deseja realizar esta ação?';
    @Input() confirmLabel = 'Confirmar';
    @Input() cancelLabel = 'Cancelar';
    @Input() confirmClass: 'danger' | 'primary' = 'danger';
    @Input() icon: 'warning' | 'delete' | 'info' = 'warning';
    @Input() loading = false;

    @Output() confirm = new EventEmitter<void>();
    @Output() cancel = new EventEmitter<void>();

    onConfirm(): void {
        this.confirm.emit();
    }

    onCancel(): void {
        this.cancel.emit();
    }

    onOverlayClick(event: MouseEvent): void {
        if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
            this.onCancel();
        }
    }
}
