"use client";

import { ICard } from "@/lib/api";
import { CARD_SHOW_PATH, getPageURL } from "@/lib/paths";
import { supabase } from "@/lib/supabase/supabaseClient";
import { getThumbnail, getYouTubeEmbedUrl, isYouTubeURL } from "@/lib/utils";
import {
  faBook,
  faCheck,
  faFlag,
  faShare,
  faSpinner,
  faThumbsUp,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import moment from "moment";
import Link from "next/link";
import { useEffect, useState } from "react";
import useClipboardApi from "use-clipboard-api";
import { useInterval } from "usehooks-ts";
import { v4 as uuidv4 } from "uuid";

const MAX_CHARACTERS_PREVIEW = 300;

const LOADING_MESSAGES = [
  "Processing your request...",
  "About 30 seconds remaining...",
  "Processing your request...",
  "About 25 seconds remaining...",
  "About 25 seconds remaining...",
  "Processing your request...",
  "About 20 seconds remaining...",
  "About 20 seconds remaining...",
  "Processing your request...",
  "Processing your request...",
  "About 15 seconds remaining...",
  "About 15 seconds remaining...",
  "Processing your request...",
  "About 10 seconds remaining...",
  "About 10 seconds remaining...",
  "Hang tight...",
  "Hang tight...",
  "Hang tight...",
  "About 5 seconds remaining...",
  "About 5 seconds remaining...",
  "Finishing up...",
];

const WAIT_MS = 2500;
const POLL_INTERVAL = 10000;

type SupabaseRealtimePayload<T = any> = {
  old: T;
  new: T;
};

interface BiasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { selected: string[]; comment: string }) => void;
}

function BiasModal({ isOpen, onClose, onSubmit }: BiasModalProps) {
  const [selectedBiases, setSelectedBiases] = useState<Record<string, boolean>>(
    {}
  );
  const [comment, setComment] = useState<string>("");

  const handleCheckboxChange = (bias: string) => {
    setSelectedBiases((prevBiases) => ({
      ...prevBiases,
      [bias]: !prevBiases[bias],
    }));
  };

  const handleSubmit = () => {
    const selected = Object.keys(selectedBiases).filter(
      (key) => selectedBiases[key]
    );
    onSubmit({ selected, comment });
    onClose();

    setSelectedBiases({});
    setComment("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed left-0 top-0 flex h-full w-full items-center justify-center bg-gray-500 bg-opacity-50">
      <div className="relative w-1/2 rounded bg-blue p-4 shadow-lg">
        <button onClick={onClose} className="absolute right-2 top-2">
          <FontAwesomeIcon icon={faTimes} />
        </button>
        <h2 className="mb-4 text-lg font-bold">Report Response</h2>
        <p className="mb-4 text-sm">
          At times, SAWT might not provide perfectly accurate information. Your
          reports on any inaccuracies are invaluable in refining our system.
        </p>
        <div className="mb-4">
          {[
            "Gender-Related Bias",
            "Cultural or Ethnic Bias",
            "Racial Bias",
            "Misleading Information or Inaccuracies",
            "Uninformative Response",
            "Factually Inaccurate",
          ].map((bias) => (
            <div key={bias}>
              <input
                type="checkbox"
                id={bias}
                checked={!!selectedBiases[bias]}
                onChange={() => handleCheckboxChange(bias)}
              />
              <label htmlFor={bias} className="ml-2">
                {bias}
              </label>
            </div>
          ))}
          <label htmlFor="comment" className="mb-2 mt-4 block">
            Comments:
          </label>
          <textarea
            id="comment"
            className="h-20 w-full rounded border p-2"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add additional feedback here"
          ></textarea>
        </div>
        <button
          onClick={handleSubmit}
          className="bg-blue-500 rounded bg-secondary px-4 py-2 text-white"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function hasLikedCardBefore(cardId?: string): boolean {
  if (!cardId || typeof window === "undefined") {
    return false;
  }
  const likedCards = JSON.parse(localStorage.getItem("likedCards") || "[]");
  return likedCards.includes(cardId);
}

function markCardAsLiked(cardId: string) {
  const likedCards = JSON.parse(localStorage.getItem("likedCards") || "[]");
  likedCards.push(cardId);
  localStorage.setItem("likedCards", JSON.stringify(likedCards));
}

export default function QueryResult({ card }: { card: ICard }) {
  const { created_at: createdAt, citations, responses, id: cardId } = card;
  const [msgIndex, setMsgIndex] = useState<number>(0);
  const isLoading = !responses || responses.length <= 0;
  const [value, copy] = useClipboardApi();
  const currentUrl = getPageURL(`${CARD_SHOW_PATH}/${cardId}`);
  const [recentlyCopied, setRecentlyCopied] = useState(false);
  const [prettyCreatedAt, setPrettyCreatedAt] = useState(
    !!createdAt && new Date(createdAt) < new Date()
      ? moment(createdAt).fromNow()
      : moment().fromNow()
  );
  const [likes, setLikes] = useState<number>(card.likes || 0);
  const [isBiasModalOpen, setBiasModalOpen] = useState(false);
  const thumbnail = getThumbnail(citations || []);

  const handleBiasReport = () => {
    setBiasModalOpen(true);
  };

  useEffect(() => {
    const channel = (supabase.channel(`cards:id=eq.${card.id}`) as any)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
        },
        (payload: SupabaseRealtimePayload<ICard>) => {
          if (
            payload.new.id === card.id &&
            payload.new.likes !== payload.old.likes
          ) {
            setLikes(payload.new.likes || 0);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [card.id]);

  const submitBiasFeedback = async ({
    selected,
    comment,
  }: {
    selected: string[];
    comment: string;
  }) => {
    try {
      const { data: existingCard, error: fetchError } = await supabase
        .from("cards")
        .select("bias")
        .eq("id", card.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const newFeedbackId = uuidv4();

      const newBias = { id: newFeedbackId, type: selected, comment };

      const existingBiases =
        existingCard.bias && Array.isArray(existingCard.bias)
          ? existingCard.bias
          : [];
      const updatedBiases = [...existingBiases, newBias];

      const { data, error } = await supabase
        .from("cards")
        .update({ bias: updatedBiases })
        .eq("id", card.id);

      if (error) {
        throw error;
      }
    } catch (error) {}
  };

  useInterval(
    () => {
      setMsgIndex((prevIndex) => (prevIndex + 1) % LOADING_MESSAGES.length);
    },
    isLoading ? WAIT_MS : null
  );

  useInterval(() => {
    setPrettyCreatedAt(moment(card.created_at).fromNow());
  }, 5_000);

  useInterval(
    () => {
      setRecentlyCopied(false);
    },
    recentlyCopied ? 3000 : null
  );

  const handleLikeUpdate = async () => {
    try {
      const newLikesValue = likes + 1;

      const { data, error } = await supabase
        .from("cards")
        .update({ likes: newLikesValue })
        .eq("id", card.id);

      if (error) {
        throw error;
      }
      setLikes(newLikesValue);
    } catch (error) {
      setLikes(likes - 1);
    }
  };

  const handleCardLike = () => {
    if (card.id) {
      if (!hasLikedCardBefore(card.id)) {
        setLikes((prevLikes) => prevLikes + 1);
        handleLikeUpdate();
        markCardAsLiked(card.id);
      } else {
        console.warn("You've already liked this card!");
      }
    }
  };

  const CardBody = () => {
    return (
      <Link href={`${CARD_SHOW_PATH}/${card.id}`}>
        <div>
          <h4 className="text-xl font-bold">{card.title}</h4>
          <h6 className="text-xs">
            <span className="text-purple">
              {card.is_mine ? "You | " : null}
            </span>
            <span className="text-secondary">{prettyCreatedAt}</span>
          </h6>

          {!isLoading && !!responses ? (
            <p className="my-5">
              {responses[0].response.substring(0, MAX_CHARACTERS_PREVIEW)}
              {responses[0].response.length > MAX_CHARACTERS_PREVIEW
                ? "..."
                : null}
            </p>
          ) : (
            <p className="my-5">
              <FontAwesomeIcon
                icon={faSpinner}
                className="mx-2 h-5 w-5 animate-spin align-middle duration-300"
              />
              {LOADING_MESSAGES[msgIndex]}
            </p>
          )}

          {isYouTubeURL(thumbnail?.source_url) && (
            <iframe
              id="ytplayer"
              src={getYouTubeEmbedUrl(thumbnail?.source_url)}
              frameBorder="0"
              className="h-64 w-full lg:h-96"
            ></iframe>
          )}
        </div>
      </Link>
    );
  };

  const CardFooter = () => {
    return (
      <div className="flex items-center justify-start text-sm text-secondary">
        <span className="ml-3 cursor-pointer" onClick={handleCardLike}>
          <FontAwesomeIcon
            icon={faThumbsUp}
            className={`mx-2 h-5 w-5 align-middle ${
              hasLikedCardBefore(card.id) ? "text-gray-400" : ""
            }`}
          />
          {likes}
        </span>

        {recentlyCopied ? (
          <span className="ml-3 text-green-400">
            <FontAwesomeIcon
              icon={faCheck}
              className="mx-2 h-5 w-5 align-middle"
            />
            Copied
          </span>
        ) : (
          <span
            className="ml-3 cursor-pointer"
            onClick={() => {
              copy(currentUrl);
              setRecentlyCopied(true);
            }}
          >
            <FontAwesomeIcon
              icon={faShare}
              className="mx-2 h-5 w-5 align-middle"
            />
            Share
          </span>
        )}
        <span className="ml-3">
          <FontAwesomeIcon
            icon={faBook}
            className="mx-2 h-5 w-5 align-middle"
          />
          {citations?.length}
        </span>

        <span className="ml-3 cursor-pointer" onClick={handleBiasReport}>
          <FontAwesomeIcon
            icon={faFlag}
            className="mx-2 h-5 w-5 align-middle"
          />
          Report
        </span>
      </div>
    );
  };

  return (
    <div
      className={`my-6 space-y-4 rounded-lg bg-blue p-6 text-primary ${
        isLoading ? "border-4 border-dashed border-yellow-500" : ""
      }`}
    >
      <CardBody />
      <CardFooter />

      <BiasModal
        isOpen={isBiasModalOpen}
        onClose={() => setBiasModalOpen(false)}
        onSubmit={submitBiasFeedback}
      />
    </div>
  );
}
