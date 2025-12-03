import {
  SchemaProperty,
  RunConfigAttribute,
  OptionsType,
  RunConfigAttributeType,
  ValueType,
} from '../../types/config-schema/config-schema';

/**
 * 辅助函数：将schema的properties转换为RunConfigAttribute映射
 * @param properties schema中的properties字段
 */
export function getConfigAttributes(properties: Record<string, SchemaProperty> = {}): Record<string, RunConfigAttribute<any>> {
  const result: Record<string, RunConfigAttribute<any>> = {};

  for (const [key, prop] of Object.entries(properties)) {
    if (!prop) continue;

    // 解析配置项类型
    let type: RunConfigAttributeType;
    if (prop.type === 'enum') {
      type = 'enum';
    } else if (prop.type === 'array') {
      type = 'array';
    } else if (['boolean', 'number', 'string', 'integer'].includes(prop.type)) {
      type = prop.type === 'integer' ? 'number' : (prop.type as RunConfigAttributeType);
    } else {
      type = 'string';
    }

    // 解析配置项label（来自schema的description，无则用key兜底）
    const label = prop.description || { zh: key, en: key };

    // 解析enum选项（从options.description提取label）
    let options: OptionsType<typeof type> | undefined;
    if (type === 'enum' && Array.isArray(prop.options)) {
      options = prop.options.map((opt) => ({
        value: opt.value,
        label: opt.description || { zh: String(opt.value), en: String(opt.value) },
      })) as OptionsType<'enum'>;
    }

    // 解析默认值
    const defaultValue: ValueType<typeof type> = prop.hasOwnProperty('defaultValue')
      ? prop.defaultValue
      : ((type === 'boolean' ? false : type === 'number' ? 0 : type === 'array' ? [] : '') as ValueType<typeof type>);

    result[key] = {
      type,
      label,
      defaultValue,
      options,
    };
  }

  return result;
}
