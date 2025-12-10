// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'conversion_history.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetConversionHistoryCollection on Isar {
  IsarCollection<ConversionHistory> get conversionHistorys => this.collection();
}

const ConversionHistorySchema = CollectionSchema(
  name: r'ConversionHistory',
  id: 5281214265820900076,
  properties: {
    r'eventCount': PropertySchema(
      id: 0,
      name: r'eventCount',
      type: IsarType.long,
    ),
    r'events': PropertySchema(
      id: 1,
      name: r'events',
      type: IsarType.objectList,
      target: r'CalendarEvent',
    ),
    r'hashCode': PropertySchema(
      id: 2,
      name: r'hashCode',
      type: IsarType.long,
    ),
    r'icsContent': PropertySchema(
      id: 3,
      name: r'icsContent',
      type: IsarType.string,
    ),
    r'originalFilePaths': PropertySchema(
      id: 4,
      name: r'originalFilePaths',
      type: IsarType.stringList,
    ),
    r'timestamp': PropertySchema(
      id: 5,
      name: r'timestamp',
      type: IsarType.dateTime,
    ),
    r'userId': PropertySchema(
      id: 6,
      name: r'userId',
      type: IsarType.string,
    )
  },
  estimateSize: _conversionHistoryEstimateSize,
  serialize: _conversionHistorySerialize,
  deserialize: _conversionHistoryDeserialize,
  deserializeProp: _conversionHistoryDeserializeProp,
  idName: r'id',
  indexes: {
    r'userId': IndexSchema(
      id: -2005826577402374815,
      name: r'userId',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'userId',
          type: IndexType.value,
          caseSensitive: true,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {r'CalendarEvent': CalendarEventSchema},
  getId: _conversionHistoryGetId,
  getLinks: _conversionHistoryGetLinks,
  attach: _conversionHistoryAttach,
  version: '3.1.0+1',
);

int _conversionHistoryEstimateSize(
  ConversionHistory object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.events.length * 3;
  {
    final offsets = allOffsets[CalendarEvent]!;
    for (var i = 0; i < object.events.length; i++) {
      final value = object.events[i];
      bytesCount +=
          CalendarEventSchema.estimateSize(value, offsets, allOffsets);
    }
  }
  bytesCount += 3 + object.icsContent.length * 3;
  bytesCount += 3 + object.originalFilePaths.length * 3;
  {
    for (var i = 0; i < object.originalFilePaths.length; i++) {
      final value = object.originalFilePaths[i];
      bytesCount += value.length * 3;
    }
  }
  bytesCount += 3 + object.userId.length * 3;
  return bytesCount;
}

void _conversionHistorySerialize(
  ConversionHistory object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeLong(offsets[0], object.eventCount);
  writer.writeObjectList<CalendarEvent>(
    offsets[1],
    allOffsets,
    CalendarEventSchema.serialize,
    object.events,
  );
  writer.writeLong(offsets[2], object.hashCode);
  writer.writeString(offsets[3], object.icsContent);
  writer.writeStringList(offsets[4], object.originalFilePaths);
  writer.writeDateTime(offsets[5], object.timestamp);
  writer.writeString(offsets[6], object.userId);
}

ConversionHistory _conversionHistoryDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = ConversionHistory(
    eventCount: reader.readLong(offsets[0]),
    events: reader.readObjectList<CalendarEvent>(
          offsets[1],
          CalendarEventSchema.deserialize,
          allOffsets,
          CalendarEvent(),
        ) ??
        [],
    icsContent: reader.readString(offsets[3]),
    id: id,
    originalFilePaths: reader.readStringList(offsets[4]) ?? const [],
    timestamp: reader.readDateTime(offsets[5]),
    userId: reader.readString(offsets[6]),
  );
  return object;
}

P _conversionHistoryDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readLong(offset)) as P;
    case 1:
      return (reader.readObjectList<CalendarEvent>(
            offset,
            CalendarEventSchema.deserialize,
            allOffsets,
            CalendarEvent(),
          ) ??
          []) as P;
    case 2:
      return (reader.readLong(offset)) as P;
    case 3:
      return (reader.readString(offset)) as P;
    case 4:
      return (reader.readStringList(offset) ?? const []) as P;
    case 5:
      return (reader.readDateTime(offset)) as P;
    case 6:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _conversionHistoryGetId(ConversionHistory object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _conversionHistoryGetLinks(
    ConversionHistory object) {
  return [];
}

void _conversionHistoryAttach(
    IsarCollection<dynamic> col, Id id, ConversionHistory object) {
  object.id = id;
}

extension ConversionHistoryQueryWhereSort
    on QueryBuilder<ConversionHistory, ConversionHistory, QWhere> {
  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhere> anyUserId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'userId'),
      );
    });
  }
}

extension ConversionHistoryQueryWhere
    on QueryBuilder<ConversionHistory, ConversionHistory, QWhereClause> {
  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      idNotEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            )
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            );
      } else {
        return query
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            )
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            );
      }
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      idLessThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      idBetween(
    Id lowerId,
    Id upperId, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: lowerId,
        includeLower: includeLower,
        upper: upperId,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      userIdEqualTo(String userId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'userId',
        value: [userId],
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      userIdNotEqualTo(String userId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'userId',
              lower: [],
              upper: [userId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'userId',
              lower: [userId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'userId',
              lower: [userId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'userId',
              lower: [],
              upper: [userId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      userIdGreaterThan(
    String userId, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'userId',
        lower: [userId],
        includeLower: include,
        upper: [],
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      userIdLessThan(
    String userId, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'userId',
        lower: [],
        upper: [userId],
        includeUpper: include,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      userIdBetween(
    String lowerUserId,
    String upperUserId, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'userId',
        lower: [lowerUserId],
        includeLower: includeLower,
        upper: [upperUserId],
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      userIdStartsWith(String UserIdPrefix) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'userId',
        lower: [UserIdPrefix],
        upper: ['$UserIdPrefix\u{FFFFF}'],
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      userIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'userId',
        value: [''],
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterWhereClause>
      userIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.lessThan(
              indexName: r'userId',
              upper: [''],
            ))
            .addWhereClause(IndexWhereClause.greaterThan(
              indexName: r'userId',
              lower: [''],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.greaterThan(
              indexName: r'userId',
              lower: [''],
            ))
            .addWhereClause(IndexWhereClause.lessThan(
              indexName: r'userId',
              upper: [''],
            ));
      }
    });
  }
}

extension ConversionHistoryQueryFilter
    on QueryBuilder<ConversionHistory, ConversionHistory, QFilterCondition> {
  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      eventCountEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'eventCount',
        value: value,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      eventCountGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'eventCount',
        value: value,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      eventCountLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'eventCount',
        value: value,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      eventCountBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'eventCount',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      eventsLengthEqualTo(int length) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'events',
        length,
        true,
        length,
        true,
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      eventsIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'events',
        0,
        true,
        0,
        true,
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      eventsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'events',
        0,
        false,
        999999,
        true,
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      eventsLengthLessThan(
    int length, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'events',
        0,
        true,
        length,
        include,
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      eventsLengthGreaterThan(
    int length, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'events',
        length,
        include,
        999999,
        true,
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      eventsLengthBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'events',
        lower,
        includeLower,
        upper,
        includeUpper,
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      hashCodeEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'hashCode',
        value: value,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      hashCodeGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'hashCode',
        value: value,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      hashCodeLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'hashCode',
        value: value,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      hashCodeBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'hashCode',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      icsContentEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'icsContent',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      icsContentGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'icsContent',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      icsContentLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'icsContent',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      icsContentBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'icsContent',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      icsContentStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'icsContent',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      icsContentEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'icsContent',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      icsContentContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'icsContent',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      icsContentMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'icsContent',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      icsContentIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'icsContent',
        value: '',
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      icsContentIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'icsContent',
        value: '',
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      idGreaterThan(
    Id value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      idLessThan(
    Id value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      idBetween(
    Id lower,
    Id upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'id',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsElementEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'originalFilePaths',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsElementGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'originalFilePaths',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsElementLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'originalFilePaths',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsElementBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'originalFilePaths',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsElementStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'originalFilePaths',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsElementEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'originalFilePaths',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsElementContains(String value,
          {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'originalFilePaths',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsElementMatches(String pattern,
          {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'originalFilePaths',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsElementIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'originalFilePaths',
        value: '',
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsElementIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'originalFilePaths',
        value: '',
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsLengthEqualTo(int length) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'originalFilePaths',
        length,
        true,
        length,
        true,
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'originalFilePaths',
        0,
        true,
        0,
        true,
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'originalFilePaths',
        0,
        false,
        999999,
        true,
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsLengthLessThan(
    int length, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'originalFilePaths',
        0,
        true,
        length,
        include,
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsLengthGreaterThan(
    int length, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'originalFilePaths',
        length,
        include,
        999999,
        true,
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      originalFilePathsLengthBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'originalFilePaths',
        lower,
        includeLower,
        upper,
        includeUpper,
      );
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      timestampEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'timestamp',
        value: value,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      timestampGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'timestamp',
        value: value,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      timestampLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'timestamp',
        value: value,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      timestampBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'timestamp',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      userIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'userId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      userIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'userId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      userIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'userId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      userIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'userId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      userIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'userId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      userIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'userId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      userIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'userId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      userIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'userId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      userIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'userId',
        value: '',
      ));
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      userIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'userId',
        value: '',
      ));
    });
  }
}

extension ConversionHistoryQueryObject
    on QueryBuilder<ConversionHistory, ConversionHistory, QFilterCondition> {
  QueryBuilder<ConversionHistory, ConversionHistory, QAfterFilterCondition>
      eventsElement(FilterQuery<CalendarEvent> q) {
    return QueryBuilder.apply(this, (query) {
      return query.object(q, r'events');
    });
  }
}

extension ConversionHistoryQueryLinks
    on QueryBuilder<ConversionHistory, ConversionHistory, QFilterCondition> {}

extension ConversionHistoryQuerySortBy
    on QueryBuilder<ConversionHistory, ConversionHistory, QSortBy> {
  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      sortByEventCount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'eventCount', Sort.asc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      sortByEventCountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'eventCount', Sort.desc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      sortByHashCode() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hashCode', Sort.asc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      sortByHashCodeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hashCode', Sort.desc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      sortByIcsContent() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'icsContent', Sort.asc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      sortByIcsContentDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'icsContent', Sort.desc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      sortByTimestamp() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'timestamp', Sort.asc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      sortByTimestampDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'timestamp', Sort.desc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      sortByUserId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'userId', Sort.asc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      sortByUserIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'userId', Sort.desc);
    });
  }
}

extension ConversionHistoryQuerySortThenBy
    on QueryBuilder<ConversionHistory, ConversionHistory, QSortThenBy> {
  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      thenByEventCount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'eventCount', Sort.asc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      thenByEventCountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'eventCount', Sort.desc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      thenByHashCode() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hashCode', Sort.asc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      thenByHashCodeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'hashCode', Sort.desc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      thenByIcsContent() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'icsContent', Sort.asc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      thenByIcsContentDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'icsContent', Sort.desc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      thenByTimestamp() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'timestamp', Sort.asc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      thenByTimestampDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'timestamp', Sort.desc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      thenByUserId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'userId', Sort.asc);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QAfterSortBy>
      thenByUserIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'userId', Sort.desc);
    });
  }
}

extension ConversionHistoryQueryWhereDistinct
    on QueryBuilder<ConversionHistory, ConversionHistory, QDistinct> {
  QueryBuilder<ConversionHistory, ConversionHistory, QDistinct>
      distinctByEventCount() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'eventCount');
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QDistinct>
      distinctByHashCode() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'hashCode');
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QDistinct>
      distinctByIcsContent({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'icsContent', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QDistinct>
      distinctByOriginalFilePaths() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'originalFilePaths');
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QDistinct>
      distinctByTimestamp() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'timestamp');
    });
  }

  QueryBuilder<ConversionHistory, ConversionHistory, QDistinct>
      distinctByUserId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'userId', caseSensitive: caseSensitive);
    });
  }
}

extension ConversionHistoryQueryProperty
    on QueryBuilder<ConversionHistory, ConversionHistory, QQueryProperty> {
  QueryBuilder<ConversionHistory, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<ConversionHistory, int, QQueryOperations> eventCountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'eventCount');
    });
  }

  QueryBuilder<ConversionHistory, List<CalendarEvent>, QQueryOperations>
      eventsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'events');
    });
  }

  QueryBuilder<ConversionHistory, int, QQueryOperations> hashCodeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'hashCode');
    });
  }

  QueryBuilder<ConversionHistory, String, QQueryOperations>
      icsContentProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'icsContent');
    });
  }

  QueryBuilder<ConversionHistory, List<String>, QQueryOperations>
      originalFilePathsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'originalFilePaths');
    });
  }

  QueryBuilder<ConversionHistory, DateTime, QQueryOperations>
      timestampProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'timestamp');
    });
  }

  QueryBuilder<ConversionHistory, String, QQueryOperations> userIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'userId');
    });
  }
}
