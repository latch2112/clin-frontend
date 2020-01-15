/* eslint-disable  */
import PropTypes from 'prop-types';
import {produce} from 'immer';
import {cloneDeep, findIndex, isEqual, last, remove } from 'lodash';
import uuidv1 from 'uuid/v1';

import * as actions from '../actions/type';
import {normalizePatientDetails} from '../helpers/struct';

const MAX_REVISIONS = 10;

export const initialVariantState = {
  schema: {},
  activePatient: null,
  activeQuery: null,
  originalQueries: [],
  draftQueries: [],
  draftHistory: [],
  results: {},
  facets: {},
  statements: [],
  activeStatementId: null,
  activeStatementTotals: {},
};

// @TODO
export const variantShape = {
  schema: PropTypes.shape({}),
  activePatient: PropTypes.String,
  activeQuery: PropTypes.String,
  originalQueries: PropTypes.array,
  draftQueries: PropTypes.array,
  draftHistory: PropTypes.array,
  results: PropTypes.shape({}),
  facets: PropTypes.shape({}),
  statements: PropTypes.array,
  activeStatementId: PropTypes.String,
  activeStatementTotals: PropTypes.array,
};

const variantReducer = (state = Object.assign({}, initialVariantState), action) => {
  return produce(state, (draft) => {
    const {draftQueries, draftHistory} = draft;
    const { payload } = action

    switch (action.type) {
      case actions.USER_LOGOUT_SUCCEEDED:
      case actions.USER_SESSION_HAS_EXPIRED:
        draft = Object.assign({}, initialVariantState);
        break;

      case actions.VARIANT_SCHEMA_SUCCEEDED:
        draft.schema = action.payload.data;
        break;

      case actions.PATIENT_FETCH_SUCCEEDED:
        const details = normalizePatientDetails(action.payload.data);
        draft.activePatient = details.id;
        let queryKey = uuidv1();
        draft.originalQueries = [{
          key: queryKey,
          instructions: [],
        }];
        draft.draftQueries = cloneDeep(draft.originalQueries);
        draft.activeQuery = queryKey;
        break;

      case actions.PATIENT_VARIANT_QUERY_SELECTION:
        if (action.payload.key) {
          draft.activeQuery = action.payload.key;
        }
        break;

      case actions.PATIENT_VARIANT_SEARCH_SUCCEEDED:
        draft.facets[action.payload.data.query] = action.payload.data.facets;
        draft.results[action.payload.data.query] = action.payload.data.hits;
        draft.activeStatementTotals[action.payload.data.query] = action.payload.data.total
        break;

      case actions.PATIENT_VARIANT_SEARCH_FAILED:
        draft.facets[action.payload.data.query] = {}
        draft.results[action.payload.data.query] = {}
        break;

      case actions.PATIENT_VARIANT_COUNT_SUCCEEDED:
        Object.keys(action.payload.data.total).forEach((key) => {
          draft.activeStatementTotals[key] = action.payload.data.total[key]
        });
        break;

      case actions.PATIENT_VARIANT_QUERY_REMOVAL:
        draft.draftQueries = draftQueries.filter((query) => !Boolean(action.payload.keys.find((key) => key === query.key)));
        draft.activeQuery = draft.draftQueries.find((query) => query.key === draft.activeQuery) ? draft.activeQuery : draft.draftQueries[0].key;
        break;

      case actions.PATIENT_VARIANT_QUERY_DUPLICATION:
        const keyToDuplicate = action.payload.query.key;
        const indexToInsertAt = action.payload.index || draft.draftQueries.length;
        const indexToDuplicate = findIndex(draft.draftQueries, {key: keyToDuplicate})
        if (indexToDuplicate) {
          draft.draftQueries.splice(indexToInsertAt, 0, action.payload.query);
          draft.activeQuery = action.payload.query.key
        }
        break;

      case actions.PATIENT_VARIANT_QUERY_REPLACEMENT:
        const {query} = action.payload;
        const index = findIndex(draftQueries, {key: query.key})
        if (index > -1) {
          draftQueries[index] = query
        } else {
          draftQueries.push(query)
        }
        draft.draftQueries = draftQueries
        break;

      case actions.PATIENT_VARIANT_QUERIES_REPLACEMENT:
        const {queries} = action.payload;
        draft.draftQueries = queries
        break;

      case actions.PATIENT_VARIANT_STATEMENT_SORT:
        const {statement} = action.payload;
        draft.draftQueries = statement
        break;

      case actions.PATIENT_VARIANT_COMMIT_HISTORY:
        const {version} = action.payload;
        const newCommit = {
          activeQuery: draft.activeQuery,
          draftQueries: version
        };
        const lastVersionInHistory = last(draftHistory)
        if (!isEqual(newCommit, lastVersionInHistory)) {
          draftHistory.push(newCommit);
        }
        const revisions = draftHistory.length;
        if (revisions > MAX_REVISIONS) {
          draftHistory.shift();
        }
        break;

      case actions.PATIENT_VARIANT_UNDO:
        const lastVersion = draftHistory.pop();
        draft.draftQueries = lastVersion.draftQueries;
        draft.activeQuery = lastVersion.activeQuery;
        break;

      case actions.PATIENT_VARIANT_GET_STATEMENTS_SUCCEEDED:
        const { response } = payload;
        const { hits , total } = response.data;

        if (total > 0) {
          draft.statements = hits.sort(function(a, b){return a._source.isDefault == true ? 1 : 0})
        } else {
          draft.statements = []
        }
        break;

    case actions.PATIENT_VARIANT_SELECT_STATEMENT_SUCCEEDED:
      let defaultStatement

      if (action.payload.key) {
        defaultStatement = state.statements.find((hit) => hit._id === action.payload.key );
      } else {
        defaultStatement = draft.statements.find((hit) => hit._source.isDefault === true );
      }
      let activeStatement = null;
      if (defaultStatement) {
        activeStatement = defaultStatement
      } else {
        activeStatement = draft.statements[0]
      }
      const activeStatementQuery = JSON.parse(activeStatement._source.queries)
      draft.activeStatementId = activeStatement._id
      draft.originalQueries = activeStatementQuery
      draft.draftQueries = activeStatementQuery
      draft.draftHistory = activeStatementQuery
      break;

    case actions.PATIENT_VARIANT_UPDATE_STATEMENT_SUCCEEDED:
      if (action.payload.key) {
        const newActiveStatement = state.statements.find((hit) => hit._id === action.payload.key );
        const newActiveStatementQuery = JSON.parse(newActiveStatement._source.queries)
        draft.activeStatementId = newActiveStatement._id
        draft.originalQueries = newActiveStatementQuery
        draft.draftQueries = newActiveStatementQuery
        draft.draftHistory = newActiveStatementQuery
      } else {
        draft.statements = []
        draft.activeStatementId = null
      }
      break;

    case actions.PATIENT_VARIANT_CREATE_STATEMENT_SUCCEEDED:
      if (action.payload.statementKeyToUpdate && action.payload.newKey) {
        draft.statements = state.statements

        // update the key // from 'draft' to ES _id
        const index = findIndex(draft.statements, { _id: action.payload.statementKeyToUpdate})

        let oldStatementToReplace = draft.statements.find((hit) => hit._id === action.payload.statementKeyToUpdate );

        oldStatementToReplace._id = action.payload.newKey
        draft.statements.splice(index, 1, oldStatementToReplace)

        draft.activeStatementId = action.payload.newKey
        const activeStatementQuery = JSON.parse(oldStatementToReplace._source.queries)
        draft.originalQueries = activeStatementQuery
        draft.draftQueries = activeStatementQuery
        draft.draftHistory = activeStatementQuery
      }
      break;

      case actions.PATIENT_VARIANT_DELETE_STATEMENT_SUCCEEDED:
        const {statementKeyToRemove} = action.payload
        draft.statements = state.statements
        remove(draft.statements, function(e) {
          return e._id == statementKeyToRemove
        });

        if (draft.statements.length > 0 ) {
          draft.statements = draft.statements.sort(function(a, b){return a._source.isDefault == true ? 1 : 0})
          const defaultStatement = draft.statements.find((hit) => hit._source.isDefault === true );
          let activeStatement = null;
          if (defaultStatement) {
            activeStatement = defaultStatement
          } else {
            activeStatement = draft.statements[0]
          }
          const activeStatementQuery = JSON.parse(activeStatement._source.queries)
          draft.activeStatementId = activeStatement._id
          draft.originalQueries = activeStatementQuery
          draft.draftQueries = activeStatementQuery
          draft.draftHistory = activeStatementQuery
        } else {
          draft.activeStatementId = null
        }
        break;

    case actions.PATIENT_VARIANT_DUPLICATE_STATEMENT_SUCCEEDED:
    case actions.PATIENT_VARIANT_CREATE_DRAFT_STATEMENT:
      const newDraftStatement = {
        _id: payload.statement.id,
        _source: {
          isDefault: false,
          description: payload.statement.description,
          title: payload.statement.title,
          queries: JSON.stringify(payload.statement.queries),
        }
      };
      draft.statements.push(newDraftStatement)
      draft.activeStatementId = payload.statement.id
      draft.originalQueries = payload.statement.queries
      draft.draftQueries = payload.statement.queries
      draft.draftHistory = payload.statement.queries
      break;

    default:
      break;
    }
  });
};

export default variantReducer;
