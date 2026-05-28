import { Component, OnInit, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { CommonModule } from '@angular/common';

export interface MultiSelectOption {
    id: any;
    name: string;
}

@Component({
    selector: 'app-multi-select',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './multi-select.component.html',
    styleUrls: ['./multi-select.component.scss'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => MultiSelectComponent),
            multi: true
        }
    ]
})
export class MultiSelectComponent implements OnInit, ControlValueAccessor {
    @Input() options: MultiSelectOption[] = [];
    @Input() placeholder: string = 'Select options';
    @Output() selectionChange = new EventEmitter<any[]>();

    selectedOptions: MultiSelectOption[] = [];
    isDropdownOpen = false;

    private onChange: (value: any[]) => void = () => { };
    private onTouched: () => void = () => { };

    constructor() { }

    ngOnInit(): void { }

    writeValue(value: any[]): void {
        if (value && Array.isArray(value)) {
            this.selectedOptions = this.options.filter(option => value.includes(option.id));
        } else {
            this.selectedOptions = [];
        }
    }

    registerOnChange(fn: (value: any[]) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    toggleDropdown(): void {
        this.isDropdownOpen = !this.isDropdownOpen;
    }

    selectOption(option: MultiSelectOption): void {
        if (!this.isSelected(option)) {
            this.selectedOptions.push(option);
        } else {
            this.selectedOptions = this.selectedOptions.filter(o => o.id !== option.id);
        }
        this.onChange(this.selectedOptions.map(o => o.id));
        this.selectionChange.emit(this.selectedOptions.map(o => o.id));
    }

    isSelected(option: MultiSelectOption): boolean {
        return this.selectedOptions.some(o => o.id === option.id);
    }

    get selectedNames(): string {
        if (this.selectedOptions.length === 0) {
            return this.placeholder;
        }
        return this.selectedOptions.map(o => o.name).join(', ');
    }

    onBlur(): void {
        this.isDropdownOpen = false;
        this.onTouched();
    }
} 