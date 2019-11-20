/* eslint-disable */

import {
  all, put, takeLatest, select,
} from 'redux-saga/effects';
import { find } from 'lodash';


import * as actions from '../actions/type';
import Api, { ApiError } from '../helpers/api';


function* fetchSchema() {
  yield put({ type: actions.START_LOADING_ANIMATION });
  try {
    const schemaResponse = yield Api.getVariantSchema();
    if (schemaResponse.error) {
      throw new ApiError(schemaResponse.error);
    }

    yield put({ type: actions.VARIANT_SCHEMA_SUCCEEDED, payload: schemaResponse.payload.data });
  } catch (e) {
    yield put({ type: actions.VARIANT_SCHEMA_FAILED, payload: e });
  }
  yield put({ type: actions.STOP_LOADING_ANIMATION });
}

function* searchVariantsForPatient(action) {
  yield put({ type: actions.START_SUBLOADING_ANIMATION });
  try {
    const {
      patient, statement, query, group, index, limit,
    } = action.payload;
    const variantResponse = yield Api.searchVariantsForPatient(patient, statement, query, group, index, limit);
    if (variantResponse.error) {
      throw new ApiError(variantResponse.error);
    }

    yield put({ type: actions.PATIENT_VARIANT_SEARCH_SUCCEEDED, payload: variantResponse.payload.data });
  } catch (e) {
    yield put({ type: actions.PATIENT_VARIANT_SEARCH_FAILED, payload: e });
  }
  yield put({ type: actions.STOP_SUBLOADING_ANIMATION });
}

function* undo() {
  const { activeQuery, draftQueries } = yield select(state => state.variant);
  const { details } = yield select(state => state.patient);
  const query = find(draftQueries, { key: activeQuery });

  if (query) {
    const payload = {
      patient: details.id,
      statement: draftQueries,
      query: query.key,
      group: 'impact',
      index: 0,
      limit: 25,
    };
    yield put({ type: actions.START_SUBLOADING_ANIMATION });
    yield put({ type: actions.PATIENT_VARIANT_SEARCH_REQUESTED, payload });
  }
}

function* watchVariantSchemaFetch() {
  yield takeLatest(actions.VARIANT_SCHEMA_REQUESTED, fetchSchema);
}

function* watchVariantSearch() {
  yield takeLatest(actions.PATIENT_VARIANT_SEARCH_REQUESTED, searchVariantsForPatient);
}

function* watchUndo() {
  yield takeLatest(actions.PATIENT_VARIANT_UNDO, undo);
}

export default function* watchedVariantSagas() {
  yield all([
    watchVariantSchemaFetch(),
    watchVariantSearch(),
    watchUndo(),
  ]);
}