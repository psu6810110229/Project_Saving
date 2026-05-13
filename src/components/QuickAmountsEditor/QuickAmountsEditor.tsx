import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { IconPiggyBank } from '../Icon/Icon';
import { TextInput } from '../TextInput/TextInput';

interface QuickAmountsEditorProps {
  amounts: string[];
  onChange: (amounts: string[]) => void;
  onSave: () => void;
}

export function QuickAmountsEditor({ amounts, onChange, onSave }: QuickAmountsEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      {amounts.map((amount, index) => (
        <div key={index} className="flex items-center gap-2">
          <FormField label={`Amount ${index + 1}`}>
            <TextInput
              value={amount}
              inputMode="numeric"
              leadingIcon={<IconPiggyBank size={16} />}
              onChange={event => onChange(amounts.map((item, itemIndex) => (
                itemIndex === index ? event.target.value.replace(/[^0-9]/g, '') : item
              )))}
            />
          </FormField>
          {amounts.length > 1 && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => onChange(amounts.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove
            </Button>
          )}
        </div>
      ))}
      {amounts.length < 6 && (
        <Button variant="ghost" size="md" onClick={() => onChange([...amounts, ''])}>
          Add Amount
        </Button>
      )}
      <Button variant="primary" fullWidth onClick={onSave}>Save Quick Amounts</Button>
    </div>
  );
}
